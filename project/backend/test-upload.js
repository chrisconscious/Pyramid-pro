import fs from 'fs';
import path from 'path';

async function run() {
  const backendUrl = 'http://localhost:5000';

  // Create a 1x1 PNG test file
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  const pngBuffer = Buffer.from(pngBase64, 'base64');
  const localFile = path.resolve('test-upload.png');
  fs.writeFileSync(localFile, pngBuffer);
  console.log('Created test image:', localFile);

  // Login
  const authResp = await fetch(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'Christianlema482@gmail.com', password: 'Lema16family' }),
  });

  const authJson = await authResp.json();
  if (!authResp.ok) {
    console.error('Login failed:', authJson);
    process.exit(1);
  }
  console.log('Login success:', authJson.message || 'ok');
  const token = authJson.data?.accessToken;
  if (!token) {
    console.error('No token returned', authJson);
    process.exit(1);
  }

  // Upload file with form data
  const formData = new FormData();
  formData.append('file', fs.createReadStream(localFile), 'test-upload.png');

  const uploadResp = await fetch(`${backendUrl}/api/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const uploadJson = await uploadResp.json();

  console.log('Upload status:', uploadResp.status, uploadResp.statusText);
  console.log('Upload response:', uploadJson);

  if (!uploadResp.ok) {
    process.exit(1);
  }

  // Verify latest file on disk
  const upDir = path.resolve('uploads');
  function findLatestFile(dir) {
    const files = [];
    function walk(d) {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) walk(full);
        else files.push(full);
      }
    }
    walk(dir);
    files.sort((a,b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return files.slice(0,5);
  }

  if (fs.existsSync(upDir)) {
    console.log('Latest files in uploads:');
    for (const f of findLatestFile(upDir)) console.log('  ', f);
  } else {
    console.log('Upload folder missing:', upDir);
  }

  console.log('Done.');
}

run().catch(err => { console.error('Error', err); process.exit(1); });