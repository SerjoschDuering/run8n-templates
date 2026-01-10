# Static Site Template

A simple static site template for the run8n stack.

## Quick Start

1. Edit `index.html` and `styles.css`
2. Deploy: `./scripts/deploy.sh mysite`
3. View at: `https://sites.run8n.xyz/mysite/`

## Deployment

```bash
./scripts/deploy.sh SITENAME
```

This rsyncs your files to the server. Changes are live immediately.

## Adding Features

### Contact Form (via Windmill)

```html
<form id="contact">
  <input name="email" type="email" required>
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
</form>

<script>
document.getElementById('contact').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  await fetch('https://windmill.run8n.xyz/api/w/main/jobs/run_wait_result/f/api/contact_form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  alert('Sent!');
});
</script>
```

### Authentication (via GoTrue)

See the `fullstack` template for auth examples.

## License

MIT
