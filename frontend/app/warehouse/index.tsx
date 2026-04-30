// Backwards-compat redirect: legacy /warehouse → /lager
import { Redirect } from 'expo-router';
export default function LegacyWarehouseRedirect() {
  return <Redirect href="/lager" />;
}
