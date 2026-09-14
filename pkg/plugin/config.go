package plugin

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
)

type Settings struct {
	Host               string `json:"host"`
	Port               int    `json:"port"`
	Database           string `json:"database"`
	ProviderMode       string `json:"providerMode"`
	OIDCIssuer         string `json:"oidcIssuer"`
	OIDCAudience       string `json:"oidcAudience"`
	OIDCBackchannelURL string `json:"oidcBackchannelUrl"`
	KeyrockBaseURL     string `json:"keyrockBaseUrl"`
	KeyrockClientID    string `json:"keyrockClientId"`
	AllowInsecureIDP   bool   `json:"allowInsecureIdp"`
	// Legacy fields remain readable so existing provisioned datasources keep
	// working until their next save migrates them to the Keyrock preset.
	KeyrockIssuer   string `json:"keyrockIssuer"`
	KeyrockJWKSURL  string `json:"keyrockJwksUrl"`
	KeyrockAudience string `json:"keyrockAudience"`
	TLSServerName   string `json:"tlsServerName"`
	TLSSkipVerify   bool   `json:"tlsSkipVerify"`
	OAuthPassThru   bool   `json:"oauthPassThru"`
}

type Secrets struct {
	TLSCACert string
}

func parseSettings(raw json.RawMessage, secure map[string]string) (Settings, Secrets, error) {
	var settings Settings
	if err := json.Unmarshal(raw, &settings); err != nil {
		return Settings{}, Secrets{}, fmt.Errorf("invalid datasource configuration: %w", err)
	}
	if settings.Port == 0 {
		settings.Port = 9030
	}
	if settings.ProviderMode == "" && !(settings.KeyrockIssuer != "" && settings.KeyrockJWKSURL != "" && settings.KeyrockAudience != "") {
		settings.ProviderMode = providerModeOIDCDiscovery
	}
	// Interactive OIDC authentication is mandatory for this datasource.
	settings.OAuthPassThru = true
	return settings, Secrets{TLSCACert: secure["tlsCACert"]}, nil
}

func parsePrivateKey(value string) (*rsa.PrivateKey, error) {
	if value == "" {
		return nil, fmt.Errorf("Doris token signing private key is not configured")
	}
	block, _ := pem.Decode([]byte(value))
	if block == nil {
		return nil, fmt.Errorf("Doris token signing private key is not PEM")
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse signing private key: %w", err)
	}
	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("Doris token signing key must be RSA")
	}
	return rsaKey, nil
}
