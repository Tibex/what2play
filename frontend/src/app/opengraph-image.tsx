import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "What2Play — Board Game Night Planner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        background: "#f5f2eb",
        padding: "80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background accent */}
      <div
        style={{
          position: "absolute",
          top: "-120px",
          right: "-120px",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(29,107,74,0.12) 0%, transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-80px",
          left: "200px",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,98,45,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Logo row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "48px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "#1d6b4a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "22px",
            fontWeight: "700",
          }}
        >
          W
        </div>
        <span
          style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "#1a1c19",
            letterSpacing: "-0.5px",
          }}
        >
          What2<span style={{ color: "#1d6b4a" }}>Play</span>
        </span>
      </div>

      {/* Headline */}
      <div
        style={{
          fontSize: "72px",
          fontWeight: "800",
          color: "#1a1c19",
          lineHeight: "1.05",
          letterSpacing: "-2px",
          maxWidth: "800px",
        }}
      >
        Stop debating.
        <br />
        <span style={{ color: "#1d6b4a" }}>Start playing.</span>
      </div>

      {/* Sub */}
      <div
        style={{
          marginTop: "32px",
          fontSize: "28px",
          color: "#6b7269",
          maxWidth: "700px",
          lineHeight: "1.4",
        }}
      >
        Board game night planner — collect libraries, vote on games, seat larger
        events.
      </div>
    </div>,
    { ...size },
  );
}
