import ShopHubScreen from '../shared/ShopHubScreen'
import { fetchOwnerProjects } from '../../api/projects'

export default function ContractorShopScreen({ navigation }) {
  return (
    <ShopHubScreen
      navigation={navigation}
      loadProjects={fetchOwnerProjects}
      pickCheckoutProject={(projects) => projects[0] || null}
    />
  )
}
