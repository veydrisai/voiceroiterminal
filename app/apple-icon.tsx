import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#09090b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 800, color: '#22c55e', lineHeight: 1, fontFamily: 'system-ui' }}>V</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#86efac', letterSpacing: 2, fontFamily: 'system-ui' }}>ROI</div>
        </div>
      </div>
    ),
    { ...size }
  )
}
