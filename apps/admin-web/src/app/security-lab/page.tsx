import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isSecurityLabUiEnabled } from '../../lib/auth-guard';

const API_SCENARIOS = [
  {
    id: 'API1',
    title: 'Broken Object Level Authorization',
    sc: 'SC-01…SC-07, SC-36',
  },
  { id: 'API2', title: 'Broken Authentication', sc: 'SC-24' },
  {
    id: 'API3',
    title: 'Broken Object Property Level Authorization',
    sc: 'SC-10, SC-31',
  },
  {
    id: 'API4',
    title: 'Unrestricted Resource Consumption',
    sc: 'SC-21, SC-57',
  },
  { id: 'API5', title: 'Broken Function Level Authorization', sc: 'SC-08' },
  {
    id: 'API6',
    title: 'Unrestricted Access to Sensitive Business Flows',
    sc: 'SC-58 (+SC-12/16/17/20)',
  },
  { id: 'API7', title: 'Server Side Request Forgery', sc: 'SC-59' },
  { id: 'API8', title: 'Security Misconfiguration', sc: 'SC-67, SC-30' },
  { id: 'API9', title: 'Improper Inventory Management', sc: 'SC-60' },
  { id: 'API10', title: 'Unsafe Consumption of APIs', sc: 'SC-61' },
];

const WEB_SCENARIOS = [
  {
    id: 'A01',
    title: 'Broken Access Control',
    sc: 'SC-01, SC-08, SC-33, SC-36',
  },
  { id: 'A02', title: 'Security Misconfiguration', sc: 'SC-28, SC-30, SC-67' },
  { id: 'A03', title: 'Software Supply Chain Failures', sc: 'SC-62' },
  { id: 'A04', title: 'Cryptographic Failures', sc: 'SC-66' },
  { id: 'A05', title: 'Injection', sc: 'SC-63' },
  { id: 'A06', title: 'Insecure Design', sc: 'SC-12, SC-20, SC-58' },
  { id: 'A07', title: 'Authentication Failures', sc: 'SC-21, SC-24' },
  {
    id: 'A08',
    title: 'Software or Data Integrity Failures',
    sc: 'SC-18, SC-17, SC-61',
  },
  { id: 'A09', title: 'Security Logging and Alerting Failures', sc: 'SC-64' },
  { id: 'A10', title: 'Mishandling of Exceptional Conditions', sc: 'SC-65' },
];

const SWAGGER_LINKS = [
  { name: 'identity', url: 'http://localhost:3001/docs' },
  { name: 'customer', url: 'http://localhost:3002/docs' },
  { name: 'catalog', url: 'http://localhost:3003/docs' },
  { name: 'media', url: 'http://localhost:3004/docs' },
  { name: 'inventory', url: 'http://localhost:3005/docs' },
  { name: 'cart', url: 'http://localhost:3006/docs' },
  { name: 'order', url: 'http://localhost:3007/docs' },
  { name: 'payment', url: 'http://localhost:3008/docs' },
  { name: 'shipping', url: 'http://localhost:3009/docs' },
  { name: 'review', url: 'http://localhost:3010/docs' },
  { name: 'warranty', url: 'http://localhost:3011/docs' },
  { name: 'support', url: 'http://localhost:3012/docs' },
  { name: 'notification', url: 'http://localhost:3013/docs' },
  { name: 'reporting', url: 'http://localhost:3014/docs' },
];

/**
 * Local security training dashboard — ONLY rendered when security-lab profile is active.
 * Not a hidden backdoor: requires authenticated admin session + lab deploy flags.
 */
export default function SecurityLabDashboardPage() {
  if (!isSecurityLabUiEnabled()) {
    notFound();
  }

  const profile = process.env['NEXATECH_DEPLOY_PROFILE'] ?? 'unknown';

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '2rem',
        background:
          'linear-gradient(160deg, #0f1720 0%, #1a2740 40%, #102033 100%)',
        color: '#e8eef7',
        fontFamily: 'IBM Plex Sans, Segoe UI, sans-serif',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <p
          style={{
            display: 'inline-block',
            border: '1px solid #f0b429',
            color: '#f0b429',
            padding: '0.25rem 0.6rem',
            fontSize: '0.75rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Lab marker — isolated training only
        </p>
        <h1 style={{ fontSize: '2rem', margin: '0.75rem 0 0.25rem' }}>
          NexaTech Security Lab Console
        </h1>
        <p style={{ color: '#9db0c7', maxWidth: 640 }}>
          Deployment profile: <strong>{profile}</strong>. Intentional
          vulnerabilities are active in this profile. Do not point scanners at
          production. No secrets are embedded on this page.
        </p>

        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>OWASP API Top 10:2023</h2>
          <ul style={{ lineHeight: 1.7, paddingLeft: '1.2rem' }}>
            {API_SCENARIOS.map((row) => (
              <li key={row.id}>
                <strong>{row.id}</strong> {row.title} — {row.sc}{' '}
                <span style={{ color: '#f0b429' }}>[vulnerable in lab]</span> /{' '}
                <span style={{ color: '#7dcea0' }}>[secure outside lab]</span>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>OWASP Web Top 10:2025</h2>
          <ul style={{ lineHeight: 1.7, paddingLeft: '1.2rem' }}>
            {WEB_SCENARIOS.map((row) => (
              <li key={row.id}>
                <strong>{row.id}</strong> {row.title} — {row.sc}
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Swagger UI (direct local)</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '0.5rem',
            }}
          >
            {SWAGGER_LINKS.map((s) => (
              <a
                key={s.name}
                href={s.url}
                style={{ color: '#8ec5ff' }}
                target="_blank"
                rel="noreferrer"
              >
                {s.name} /docs
              </a>
            ))}
          </div>
        </section>

        <section style={{ marginTop: '1.5rem', color: '#9db0c7' }}>
          <h2 style={{ fontSize: '1.1rem', color: '#e8eef7' }}>PoC docs</h2>
          <ul style={{ lineHeight: 1.7 }}>
            <li>
              <code>docs/OWASP-SCENARIOS.md</code>
            </li>
            <li>
              <code>docs/LOCAL-SECURITY-LAB-GUIDE.md</code>
            </li>
            <li>
              <code>docs/SWAGGER-LINKS.md</code>
            </li>
            <li>
              <code>openapi/nexatech-combined.openapi.yaml</code>
            </li>
            <li>
              Lab marker:{' '}
              <a
                href="http://localhost:3001/health/lab"
                style={{ color: '#8ec5ff' }}
              >
                identity /health/lab
              </a>
            </li>
          </ul>
        </section>

        <p style={{ marginTop: '2rem' }}>
          <Link href="/bang-dieu-khien" style={{ color: '#8ec5ff' }}>
            ← Quay lại admin
          </Link>
        </p>
      </div>
    </main>
  );
}
