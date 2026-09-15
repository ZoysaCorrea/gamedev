import './globals.css';
import AdsenseGame from '../components/AdsenseGame';

export const metadata = {
  title: 'Drunken Legend',
  description: 'Simple arcade shooter',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AdsenseGame />
        {children}
      </body>
    </html>
  );
}
