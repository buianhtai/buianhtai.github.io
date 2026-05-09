# Keycloak Research: Official Documentation & Feature Set

*Research compiled March 23, 2026 for technical blog writing*

---

## 1. Overview

**Keycloak** is an open-source Identity and Access Management (IAM) solution that enables authentication and authorization for modern applications and services. It is built on industry-standard security protocols and provides centralized management for users, applications, and services.

- **Website**: https://www.keycloak.org/
- **Current Version**: 26.5.6 (released March 19, 2026)
- **License**: Open-source (Apache 2.0)
- **Primary Sponsor**: Red Hat
- **CNCF Status**: Incubating project (accepted April 10, 2023)

### Key Metrics (CNCF)
- **Total Contributors**: 59,712 (+22% YoY)
- **Contributing Organizations**: 10,792 (+22% YoY)
- **GitHub Stars**: 41,972 (+26% YoY)
- **GitHub Forks**: 12,811 (+13% YoY)
- **Software Value**: $3.82B

---

## 2. Core Features

### 2.1 Single Sign-On (SSO)

Users authenticate with Keycloak rather than individual applications. Applications don't need to deal with:
- Login forms
- Authenticating users
- Storing users

**Benefits:**
- Login once → access multiple applications
- Single logout (sign-out from all applications)
- Centralized session management

**Evidence**: https://www.keycloak.org/ (Single-Sign On section)

### 2.2 Identity Brokering

Keycloak can authenticate users with existing external Identity Providers:
- **OpenID Connect** providers
- **SAML 2.0** providers

Configuration is done through the Admin Console—no code changes required to applications.

### 2.3 Social Login

Enabling login with social networks is easy through the Admin Console:
- Select the social network to add
- No code or application changes required
- Supports major providers out of the box

### 2.4 User Federation

Built-in support to connect to existing user stores:

| Provider | Description |
|----------|-------------|
| **LDAP** | Connect to existing LDAP directories |
| **Active Directory** | Integration with Microsoft AD |
| **Custom Provider** | Implement your own provider for databases or other stores |

### 2.5 Admin Console

Web-based administration interface for centralized management:
- Enable/disable features
- Configure identity brokering and user federation
- Create and manage applications/clients
- Define fine-grained authorization policies
- Manage users, permissions, and sessions

### 2.6 Account Management Console

Self-service portal for end users:
- Update profile information
- Change passwords
- Setup two-factor authentication
- Manage sessions
- View account history
- Link accounts with social providers or identity brokers

### 2.7 Authorization Services

Fine-grained authorization beyond simple role-based access control:
- Manage permissions for all services from Admin Console
- Define exactly the policies needed
- Support for OAuth 2.0 UMA (User-Managed Access)
- Resource-based permissions

---

## 3. Supported Protocols

Keycloak is based on **standard protocols** and provides full support for:

### 3.1 OpenID Connect (OIDC)
- **Type**: Identity layer on top of OAuth 2.0
- **Certification**: OpenID certified
- **Use Case**: Modern web and mobile applications
- **Token Types**: ID tokens, access tokens, refresh tokens

### 3.2 OAuth 2.0
- **Grant Types**: Authorization Code, Client Credentials, Device Flow, JWT Authorization Grant, DPoP
- **Features**: Token exchange, PKCE support, PAR (Pushed Authorization Requests)
- **Extensions**: UMA 2.0 for user-managed access

### 3.3 SAML 2.0
- **Type**: XML-based authentication protocol
- **Use Case**: Enterprise applications, legacy systems
- **Features**: SP and IdP initiated SSO, artifact binding, POST binding

**Evidence**: https://www.keycloak.org/ (Standard Protocols section)

---

## 4. Authentication Methods

### 4.1 Password-Based Authentication
- Classic username/password
- Customizable password policies (length, complexity, history, expiration)

### 4.2 Passwordless Authentication
- **WebAuthn/Passkeys**: Modern passwordless standard (now fully supported as of v26.4)
- **Kerberos**: For enterprise environments
- **X.509 Certificates**: Smart card authentication

### 4.3 Multi-Factor Authentication (MFA)
- **Time-based OTP (TOTP)**: Authenticator apps
- **Recovery Codes**: Backup authentication codes
- **Conditional UI Authenticator**: Step-up authentication based on context

### 4.4 Client Authentication Methods
- Client secrets (static)
- JWT assertions (RFC 7523)
- mTLS (Mutual TLS)
- **Federated Client Authentication** (preview): SPIFFE JWT SVIDs, Kubernetes service account tokens

**Evidence**: https://www.keycloak.org/2024/10/keycloak-2600-released

---

## 5. Keycloak Distribution: WildFly → Quarkus

### 5.1 The Migration

Keycloak underwent a major architectural change starting with **version 17**:

| Aspect | WildFly (Legacy) | Quarkus (Current) |
|--------|------------------|-------------------|
| **Framework** | JBoss/WildFly application server | Kubernetes-native Quarkus |
| **Configuration** | Complex XML files | Simple `keycloak.conf` |
| **Startup Time** | Minutes | Seconds |
| **Memory Usage** | Higher | ~50% less |
| **Custom Providers** | Dynamic module deployment | Runtime rebuild required |
| **Context Path** | `/auth/` prefix | Direct root path |
| **Packaging** | EAR supported | JAR only |
| **Hot Deployment** | Supported | Not supported |

### 5.2 Key Changes with Quarkus

1. **Immutable Runtime**: Custom providers must be built during image build
2. **Simplified Configuration**: Environment variables and CLI options replace XML
3. **Removal of `/auth`**: URLs now use direct paths
4. **No EAR Support**: Quarkus doesn't support EAR packaging
5. **No `jboss-deployment-structure.xml`**: Different dependency management

### 5.3 Migration Path

The WildFly distribution was deprecated and removed. Migration steps:
1. Export realm data from WildFly version
2. Deploy new Quarkus version
3. Database auto-migrates on first startup
4. Re-import realm data
5. Update custom providers (rebuild for Quarkus)
6. Update application URLs (remove `/auth` prefix)

**Evidence**: 
- https://www.keycloak.org/2023/09/keycloak-22-released
- https://www.keycloak.org/2024/10/keycloak-2600-released
- CNCF Blog: Keycloak 26 release

---

## 6. CNCF Ecosystem

### 6.1 CNCF Status
- **Accepted**: April 10, 2023
- **Maturity Level**: Incubating
- **Project Page**: https://www.cncf.io/projects/keycloak/

### 6.2 Community Events

| Event | Description |
|-------|-------------|
| **KeycloakCon** | Annual co-located event at KubeCon |
| **KeycloakCon Japan** | Half-day conference in Yokohama, Japan (July 28, 2026) |
| **KubeCon** | Project pavilion and talks at major CNCF conferences |

### 6.3 Integration with CNCF Projects

Keycloak integrates with various CNCF projects:
- **Kubernetes**: Service account authentication, Operator support
- **SPIFFE/SPIRE**: Workload identity federation
- **Istio**: Service mesh integration
- **OpenTelemetry**: Built-in tracing and metrics
- **Argo CD**: GitOps workflows

### 6.4 Cloud Native Characteristics

- Designed for containerized environments
- Kubernetes operator available
- OpenShift support
- Horizontal scalability
- Health endpoints for orchestration
- Metrics endpoint for monitoring

**Evidence**: 
- https://www.cncf.io/projects/keycloak/
- https://www.cncf.io/blog/2024/11/13/scalable-authentication-across-organizations-with-keycloak-26/

---

## 7. Deployment Options

### 7.1 Container (Recommended)

**Registry**: `quay.io/keycloak/keycloak`

**Dockerfile Example**:
```dockerfile
FROM quay.io/keycloak/keycloak:latest AS builder

# Enable health and metrics support
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

# Configure a database vendor
ENV KC_DB=postgres

WORKDIR /opt/keycloak

# Build optimized image
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:latest
COPY --from=builder /opt/keycloak/ /opt/keycloak/

# Configuration
ENV KC_DB=postgres
ENV KC_DB_URL=<DBURL>
ENV KC_DB_USERNAME=<DBUSERNAME>
ENV KC_DB_PASSWORD=<DBPASSWORD>
ENV KC_HOSTNAME=localhost

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
```

### 7.2 Kubernetes

**Operator**: Official Keycloak Operator for Kubernetes

**Helm Chart**: Available for quick deployment

**Features**:
- Custom Resource Definitions (CRDs)
- High availability deployments
- Multi-cluster support
- Automatic certificate management

### 7.3 OpenShift

- Dedicated operator in OperatorHub
- S2I (Source-to-Image) support
- Built-in integration with OpenShift authentication

### 7.4 Bare Metal / VM

**Getting Started Options**:
- ZIP distribution
- OpenJDK installation
- Systemd service support
- Windows service support (recent addition)

### 7.5 Database Support

| Database | Support Level |
|----------|---------------|
| **PostgreSQL** | Recommended for production |
| **MySQL/MariaDB** | Supported |
| **Oracle** | Supported |
| **SQL Server** | Supported |
| **Dev Mode** | H2 (built-in) |

**Evidence**: https://www.keycloak.org/guides → Running Keycloak in a container

---

## 8. Organizations Feature (Multi-Tenancy)

Introduced in Keycloak 25 (preview), **fully supported in Keycloak 26**:

### 8.1 Purpose
- **CIAM** (Customer Identity and Access Management)
- **B2B** (Business-to-Business) scenarios
- **B2B2C** (Business-to-Business-to-Customer) setups
- Multi-tenancy support

### 8.2 Key Capabilities

| Feature | Description |
|---------|-------------|
| **Organization Entity** | First-class organizational representation |
| **Domain Association** | Link email domains to identity providers |
| **Member Management** | Create, disable, invite users |
| **Identity-First Login** | Smart routing based on email domain |
| **Token Decoration** | Organization claims in access tokens |
| **Invitation System** | Email-based invitation workflow |

### 8.3 Use Cases

1. SaaS applications serving multiple customer organizations
2. B2B portals with partner company authentication
3. Enterprise applications integrating with customer IdPs

**Evidence**: https://www.keycloak.org/2024/06/announcement-keycloak-organizations

---

## 9. Advanced Features (v26+)

### 9.1 Workflows (Preview)
- Automate administrative tasks
- Identity Governance and Administration (IGA)
- Custom approval processes

### 9.2 DPoP (Demonstrating Proof-of-Possession)
- **Status**: Fully supported (v26.4+)
- Binds tokens to client keys
- Prevents token theft/replay attacks

### 9.3 JWT Authorization Grant
- RFC 7523 support
- External signed JWT assertions for token requests
- Recommended alternative to direct token exchange

### 9.4 MCP (Model Context Protocol) Authorization
- Authorization server for AI/MCP servers
- OAuth 2.0 Server Metadata compliance

### 9.5 OpenTelemetry Integration
- Built-in tracing (preview in v26, improved in v26.5)
- Metrics and logging via OpenTelemetry
- Root cause analysis for latencies

### 9.6 Persistent User Sessions
- All user sessions persisted to database
- Required for high-availability multi-site deployments
- Cross-datacenter session failover

**Evidence**: https://www.keycloak.org/2026/01/keycloak-2650-released

---

## 10. Documentation Structure

### Official Documentation (keycloak.org/guides)

#### Getting Started
- OpenJDK (bare metal)
- Docker
- Podman
- Kubernetes
- OpenShift
- Scaling and tuning

#### Server Configuration
- Configuration guide
- Production setup
- Admin recovery
- Directory structure
- TLS configuration
- Hostname configuration
- Reverse proxy setup
- Database configuration
- Distributed caches
- Outgoing HTTP requests
- Truststore configuration
- Mutual TLS

#### Securing Applications
- Planning overview
- OIDC integration
- JavaScript adapter
- Node.js adapter
- SAML (WildFly/EAP)
- Docker registry

#### Observability
- OpenTelemetry integration
- Health checks
- Metrics
- Event metrics
- Service Level Indicators
- Troubleshooting

---

## 11. Why Teams Choose Keycloak

### Advantages

| Benefit | Description |
|---------|-------------|
| **Zero Licensing Costs** | No per-user or per-application fees |
| **Standard Protocols** | Full OIDC, OAuth 2.0, SAML support |
| **Active Community** | CNCF-backed with Red Hat support |
| **Flexibility** | Complete control over deployment |
| **Cloud Native** | Kubernetes operators, container-first |
| **Extensibility** | Custom providers, themes, SPI |
| **Self-Hosted** | Data stays in your infrastructure |

### Real-World Adoption

| Organization | Scale |
|--------------|-------|
| **IFTM** | 12,000+ active users (Gov.br SSO) |
| **Infosys** | 2M+ users across healthcare ecosystem |
| **Japanese Healthcare** | 200,000+ users on Azure |

**Evidence**: https://www.cncf.io/projects/keycloak/ (Case Studies section)

---

## 12. Quick Reference Links

| Resource | URL |
|----------|-----|
| **Official Site** | https://www.keycloak.org/ |
| **Documentation** | https://www.keycloak.org/guides |
| **Downloads** | https://www.keycloak.org/downloads |
| **GitHub** | https://github.com/keycloak/keycloak |
| **CNCF Project** | https://www.cncf.io/projects/keycloak/ |
| **Docker Image** | `quay.io/keycloak/keycloak` |
| **Community Forum** | https://github.com/keycloak/keycloak/discussions |

---

*Document compiled: March 23, 2026*
*Sources: keycloak.org, cncf.io, official blog posts, GitHub discussions*
