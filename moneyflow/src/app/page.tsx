import { redirect } from 'next/navigation';

/**
 * The middleware sends signed-in users to the dashboard before this renders;
 * anyone who gets here is not signed in.
 */
export default function RootPage() {
  redirect('/login');
}
