export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head />
      <body style={{ margin: 0, padding: 0, background: "transparent" }}>
        {children}
      </body>
    </html>
  )
}
