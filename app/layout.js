import './globals.css';

export const metadata = {
  title: 'Drunken Legend',
  description: 'Browser edition of Drunken Legend.'
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
