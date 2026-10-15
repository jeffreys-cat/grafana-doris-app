import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConfigEditor } from './ConfigEditor';
import type { DorisSSOJsonData, DorisSecureJsonData } from './types';

type Props = DataSourcePluginOptionsEditorProps<DorisSSOJsonData, DorisSecureJsonData>;

function props(jsonData: DorisSSOJsonData): Props {
    return {
        options: { jsonData, secureJsonData: { password: 'existing-password' }, secureJsonFields: { password: true } },
        onOptionsChange: jest.fn(),
    } as unknown as Props;
}

describe('SSO identity forwarding', () => {
    it('enables forwarding together with SSO and disables it when switching back to password authentication', () => {
        const input = props({ enableSso: false, host: 'doris.example' });
        const { rerender } = render(<ConfigEditor {...input} />);
        expect(input.onOptionsChange).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('checkbox', { name: /^Enable SSO/ }));
        const enabled = (input.onOptionsChange as jest.Mock).mock.calls[0][0];
        expect(enabled.jsonData).toEqual(expect.objectContaining({ enableSso: true, oauthPassThru: true, host: 'doris.example' }));
        expect(enabled.secureJsonData).toEqual(input.options.secureJsonData);
        rerender(<ConfigEditor {...input} options={enabled} />);
        fireEvent.click(screen.getByRole('checkbox', { name: /^Enable SSO/ }));
        expect(input.onOptionsChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ jsonData: expect.objectContaining({ enableSso: false, oauthPassThru: false }) }),
        );
    });

    it.each([undefined, false])('repairs existing SSO configurations with oauthPassThru=%s when opened', oauthPassThru => {
        const input = props({ enableSso: true, oauthPassThru, oidcIssuer: 'https://idp.example', host: 'doris.example' });
        const { rerender } = render(<ConfigEditor {...input} />);
        expect(input.onOptionsChange).toHaveBeenCalledTimes(1);
        const updated = (input.onOptionsChange as jest.Mock).mock.calls[0][0];
        expect(updated.jsonData).toEqual({ ...input.options.jsonData, oauthPassThru: true });
        expect(updated.secureJsonData).toEqual(input.options.secureJsonData);
        rerender(<ConfigEditor {...input} options={updated} />);
        expect(input.onOptionsChange).toHaveBeenCalledTimes(1);
    });

    it('preserves legacy SSO mode while repairing forwarding', () => {
        const input = props({ oidcIssuer: 'https://idp.example' });
        render(<ConfigEditor {...input} />);
        expect(input.onOptionsChange).toHaveBeenCalledWith(
            expect.objectContaining({ jsonData: expect.objectContaining({ enableSso: true, oauthPassThru: true }) }),
        );
    });

    it('turns off stale identity forwarding for explicit password authentication', () => {
        const input = props({ enableSso: false, oauthPassThru: true });
        render(<ConfigEditor {...input} />);
        expect(input.onOptionsChange).toHaveBeenCalledWith(
            expect.objectContaining({ jsonData: expect.objectContaining({ enableSso: false, oauthPassThru: false }) }),
        );
    });
});

describe('Doris TLS certificate verification', () => {
    it.each([true, false])('can select REQUIRED-style verification with enableSso=%s while preserving IDP settings', enableSso => {
        const input = props({ enableSso, oauthPassThru: enableSso, tlsEnabled: true, idpTlsSkipVerify: false });
        const { rerender } = render(<ConfigEditor {...input} />);
        const toggle = screen.getByRole('checkbox', { name: 'Verify Doris TLS certificate' });
        expect(toggle).toBeChecked();
        fireEvent.click(toggle);
        const updated = (input.onOptionsChange as jest.Mock).mock.calls[0][0];
        expect(updated.jsonData).toEqual(expect.objectContaining({ tlsEnabled: true, tlsSkipVerify: true, idpTlsSkipVerify: false, enableSso }));
        expect(updated.secureJsonData).toEqual(input.options.secureJsonData);
        rerender(<ConfigEditor {...input} options={updated} />);
        expect(screen.getByRole('checkbox', { name: 'Verify Doris TLS certificate' })).not.toBeChecked();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Verify Doris TLS certificate' }));
        expect(input.onOptionsChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ jsonData: expect.objectContaining({ tlsEnabled: true, tlsSkipVerify: false, idpTlsSkipVerify: false }) }),
        );
    });

    it('hides certificate verification when TLS is disabled', () => {
        render(<ConfigEditor {...props({ enableSso: false, tlsEnabled: false })} />);
        expect(screen.queryByRole('checkbox', { name: 'Verify Doris TLS certificate' })).not.toBeInTheDocument();
    });
});
