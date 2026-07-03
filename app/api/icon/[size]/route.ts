import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeStr } = await params;
  const size = parseInt(sizeStr) || 192;
  const radius = size * 0.22;
  const fontSize = size * 0.48;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #1e40af 0%, #2563eb 60%, #3b82f6 100%)',
          borderRadius: radius,
        }}
      >
        {/* Shadow layer for depth */}
        <div
          style={{
            position: 'absolute',
            bottom: size * 0.12,
            left: size * 0.18,
            right: size * 0.18,
            height: size * 0.06,
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '50%',
            filter: 'blur(8px)',
            display: 'flex',
          }}
        />
        <div
          style={{
            color: 'white',
            fontSize: fontSize,
            fontWeight: 900,
            fontFamily: 'Georgia, serif',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            display: 'flex',
            textShadow: `0 ${size * 0.03}px ${size * 0.06}px rgba(0,0,0,0.3)`,
          }}
        >
          V
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
