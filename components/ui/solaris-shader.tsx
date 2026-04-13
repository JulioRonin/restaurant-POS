import React from "react";
import { MeshGradient } from "@paper-design/shaders-react";

export const SolarisShader: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-none bg-black">
      <MeshGradient
        className="absolute inset-0 w-full h-full opacity-60"
        colors={["#000000", "#1a0b02", "#451a03", "#ea580c", "#f97316"]}
        speed={0.4}
        backgroundColor="#000000"
      />
      
      {/* Animated Light Beams for Premium Feel */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-solaris-orange/10 via-transparent to-transparent rotate-12 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[100%] bg-gradient-to-tl from-solaris-orange/5 via-transparent to-transparent -rotate-12"></div>
      </div>

      {/* Noise Texture for Digital Aesthetic */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
    </div>
      
      {/* Overlay for even more depth */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black via-transparent to-solaris-orange/5 opacity-50"></div>
    </div>
  );
};
