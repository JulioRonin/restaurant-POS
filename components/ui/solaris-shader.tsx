import React from "react";

export const SolarisShader: React.FC = () => {
  return (
    <div className="fixed inset-0 w-screen h-screen z-0 overflow-hidden pointer-events-none">
      {/* KŌSO brand background image */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/bg-koso.jpg')" }}
      />
      {/* Subtle dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
    </div>
  );
};
