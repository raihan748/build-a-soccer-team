import './globals.css';

export const metadata = {
  title: 'Soccer Team Manager - FUT Live Transfer & Match Simulator',
  description: 'Multiplayer Soccer Team Manager game with 500+ World Footballers, Live Transfer Market, 2D Tactical Match Engine, and Zero-Config P2P Multiplayer!',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased min-h-screen bg-[#0b0e14] text-slate-100 selection:bg-amber-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
