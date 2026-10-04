// Engineer's supplier hub: same shared shop; the backend already limits
// /shop/products to builder-approved suppliers for engineers. Checkout is
// tied to the engineer's first assigned project.
import ShopHubScreen from '../shared/ShopHubScreen'
import { fetchEngineerProjects } from '../../api/engineers'

export default function EngineerSuppliersScreen({ navigation }) {
  return (
    <ShopHubScreen
      navigation={navigation}
      loadProjects={fetchEngineerProjects}
      pickCheckoutProject={(projects) => projects[0] || null}
    />
  )
}