import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#09090b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', fontFamily: 'system-ui', lineHeight: 1 }}>V</div>
      </div>
    ),
    { ...size }
  )
}
