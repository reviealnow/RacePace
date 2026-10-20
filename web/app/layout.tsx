import type { ReactNode } from 'react';
export const metadata = { title: 'RacePace', description: 'Your pace plan and private workout library.' };
export default function Layout({children}: {children: ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
