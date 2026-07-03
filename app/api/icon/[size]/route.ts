import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeStr } = await params;
  const size = parseInt(sizeStr) || 192;

  const logoUrl = new URL('/vidrow-logo.png', req.url).toString();
  const padding = size * 0.12;

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
          borderRadius: size * 0.2,
          padding,
        }}
      >
        <img
          src={logoUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    { width: size, height: size }
  );
}
