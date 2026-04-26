import React from "react";

export const SolarisShader: React.FC = () => {
  return (
    <div className="fixed inset-0 w-screen h-screen z-0 overflow-hidden pointer-events-none bg-black">
      {/* Replaced heavy MeshGradient with static high-performance image */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat opacity-80"
        style={{ backgroundImage: "url('/bg-solaris.png')" }}
      />
      
      {/* Noise Texture for Digital Aesthetic */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      
      {/* Overlay to ensure readability */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/40 to-transparent opacity-60"></div>
    </div>
  );
};
