// Backwards-compat redirect: legacy /warehouse-3d → /lager-planer
import { Redirect } from 'expo-router';
export default function LegacyWarehouse3DRedirect() {
  return <Redirect href="/lager-planer" />;
}
