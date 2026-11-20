import CampusClient from '@/components/campus/CampusClient';

/**
 * The whole entry experience is the 3D campus (title → character → building).
 * `/hub` remains as the accessible 2D route for devices without WebGL2.
 */
export default function Home() {
  return <CampusClient />;
}
