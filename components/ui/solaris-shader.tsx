import React from "react";

export const SolarisShader: React.FC = () => {
  return (
    <div className="fixed inset-0 w-screen h-screen z-0 overflow-hidden pointer-events-none" style={{ background: '#FAFAF3' }}>
      {/* Soft radial olive blobs — 40% olive brand presence */}
      <div className="absolute top-[-10%] left-[-5%] w-[60vw] h-[60vw] rounded-full opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #505530 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #505530 0%, transparent 70%)' }} />

      {/* Salmon accent glow — 20% accent */}
      <div className="absolute top-[30%] right-[20%] w-[30vw] h-[30vw] rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #F98359 0%, transparent 65%)' }} />

      {/* Purple micro accent — 5% */}
      <div className="absolute bottom-[25%] left-[15%] w-[15vw] h-[15vw] rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #C694DB 0%, transparent 65%)' }} />

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
    </div>
  );
};
