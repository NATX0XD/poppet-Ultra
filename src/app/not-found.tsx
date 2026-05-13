'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function NotFound() {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setBlink(b => !b), 400);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #0d0d1a 60%, #000 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#e2e8f0',
      textAlign: 'center',
      padding: '24px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-18px) rotate(2deg); }
        }
        @keyframes glitch {
          0%, 100% { text-shadow: 2px 0 #f43f5e, -2px 0 #38bdf8; }
          25% { text-shadow: -2px 0 #f43f5e, 2px 0 #38bdf8; transform: translateX(2px); }
          50% { text-shadow: 2px 0 #a78bfa, -2px 0 #34d399; transform: translateX(-2px); }
          75% { text-shadow: -2px 0 #a78bfa, 2px 0 #34d399; transform: translateX(1px); }
        }
        @keyframes stars {
          from { transform: translateY(0); }
          to { transform: translateY(-100vh); }
        }
        .stars {
          position: fixed; top: 0; left: 0; width: 100%; height: 200vh;
          background-image:
            radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.6) 0%, transparent 100%),
            radial-gradient(1px 1px at 30% 40%, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(1px 1px at 55% 20%, rgba(255,255,255,0.5) 0%, transparent 100%),
            radial-gradient(1px 1px at 75% 60%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 90% 30%, rgba(255,255,255,0.6) 0%, transparent 100%),
            radial-gradient(1px 1px at 20% 70%, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(1px 1px at 45% 85%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 65% 45%, rgba(255,255,255,0.5) 0%, transparent 100%),
            radial-gradient(1px 1px at 85% 80%, rgba(255,255,255,0.4) 0%, transparent 100%);
          animation: stars 60s linear infinite;
          pointer-events: none;
          z-index: 0;
        }
        .cat-img {
          animation: float 3s ease-in-out infinite;
          image-rendering: pixelated;
          filter: drop-shadow(0 0 30px rgba(167,139,250,0.5));
        }
        .four-zero-four {
          font-size: clamp(80px, 18vw, 160px);
          font-weight: 900;
          line-height: 1;
          animation: glitch 3s ease-in-out infinite;
          background: linear-gradient(135deg, #a78bfa, #f43f5e, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -4px;
        }
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          border: none;
          border-radius: 50px;
          padding: 16px 36px;
          font-size: 18px;
          font-weight: 800;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s;
          box-shadow: 0 8px 32px rgba(99,102,241,0.4);
        }
        .back-btn:hover {
          transform: translateY(-3px) scale(1.04);
          box-shadow: 0 16px 40px rgba(99,102,241,0.5);
        }
      `}</style>

      <div className="stars" />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Cat image — blinking open/closed mouth */}
        <div className="cat-img" style={{ marginBottom: 16 }}>
          <img
            src={blink ? '/assent/popcat Costume/popcat.png' : '/assent/popcat Costume/popcat-open.png'}
            alt="Popcat 404"
            width={180}
            height={180}
            style={{ objectFit: 'contain' }}
            onError={(e) => { (e.target as HTMLImageElement).style.fontSize = '120px'; (e.target as HTMLImageElement).alt = '🐱'; }}
          />
        </div>

        <div className="four-zero-four">404</div>

        <h1 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, margin: '16px 0 8px', color: '#f1f5f9' }}>
          หน้านี้ไม่มีอยู่จริง!
        </h1>
        <p style={{ color: '#64748b', fontSize: 'clamp(14px, 2.5vw, 18px)', margin: '0 0 40px', maxWidth: 440, lineHeight: 1.6 }}>
          แมวกิน URL นั้นไปแล้ว 😿<br />
          หน้าที่คุณตามหาหายไป หรืออาจไม่เคยมีอยู่ตั้งแต่ต้น
        </p>

        <Link href="/" className="back-btn">
          🐱 กลับไปกดแมว
        </Link>


      </div>
    </div>
  );
}
