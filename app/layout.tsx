import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata = {
  title: 'GenLayer Benchmark Explorer',
  description: 'Analysis and breakdown of Polymarket resolution through GenLayer Intelligent Contracts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <Navigation />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
