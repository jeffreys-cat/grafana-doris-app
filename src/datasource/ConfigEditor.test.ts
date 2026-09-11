import { buildDorisBootstrapSQL } from './ConfigEditor';

describe('buildDorisBootstrapSQL', () => {
  it('maps deduplicated Doris roles through the signed groups claim', () => {
    const sql = buildDorisBootstrapSQL({
      dorisRole: 'doris_reader',
      groupRoleMappings: [
        { oidcGroup: '/doris-readers', dorisRole: 'doris_reader' },
        { oidcGroup: '/doris-writers', dorisRole: 'doris_writer' },
      ],
    }, {
      configured: true,
      issuer: 'https://grafana.example/doris-sso',
      jwksPublicUrl: 'https://grafana.example/.well-known/jwks.json',
      audience: 'velodb-doris:datasource-a',
    });

    expect(sql).toContain("'oidc.groups_claim'='doris_groups'");
    expect(sql).toContain("'oidc.allowed_audiences'='velodb-doris:datasource-a'");
    expect(sql).toContain('CREATE AUTHENTICATION INTEGRATION `grafana_doris_sso_datasource_a`');
    expect(sql).toContain('CREATE ROLE MAPPING `grafana_doris_sso_datasource_a_roles`');
    expect(sql.match(/CREATE ROLE `doris_reader`;/g)).toHaveLength(1);
    expect(sql).toContain(`has_group("doris_reader")`);
    expect(sql).toContain(`has_group("doris_writer")`);
  });
});
