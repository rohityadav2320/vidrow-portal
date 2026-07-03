import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeStr } = await params;
  const size = parseInt(sizeStr) || 192;
  const padding = size * 0.1;

  const logoPath = path.join(process.cwd(), 'public', 'vidrow-logo.png');
  const logoData = fs.readFileSync(logoPath);
  const base64 = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          padding,
        }}
      >
        <img
          src={base64}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    ),
    { width: size, height: size }
  );
}
