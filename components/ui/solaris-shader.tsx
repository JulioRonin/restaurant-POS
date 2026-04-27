import React from "react";

export const SolarisShader: React.FC = () => {
  return (
    <div className="fixed inset-0 w-screen h-screen z-0 overflow-hidden pointer-events-none bg-[#12140d]">
      {/* Replaced heavy MeshGradient with static high-performance image */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat opacity-75"
        style={{ backgroundImage: "url('/bg-solaris.png')" }}
      />
      
      {/* Noise Texture for Digital Aesthetic */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      
      {/* Olive tinted overlay for KŌSO brand feel */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#12140d] via-[#1a1c14]/50 to-transparent opacity-70"></div>
    </div>
  );
};
