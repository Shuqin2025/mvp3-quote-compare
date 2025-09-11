import React, { useState } from "react";

export default function App() {
  const [text, setText] = useState("");

  const handleClick = () => {
    console.log("输入内容：", text);
    alert(`你输入了：${text}`);
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      <h1 style={{ margin: "0 0 12px" }}>MVP3 — App</h1>

      <p>请输入测试内容：</p>
      <input
        style={{
          padding: "8px",
          border: "1px solid #ccc",
          width: "300px",
          marginRight: "8px"
        }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="输入内容"
      />
      <button
        onClick={handleClick}
        style={{
          padding: "8px 16px",
          background: "#007bff",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}
      >
        点击测试
      </button>
    </div>
  );
}
