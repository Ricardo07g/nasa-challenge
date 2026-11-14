import { useHomeController } from './controllers/useHomeController'
import { HomeView } from './views/HomeView'

function App() {
  const state = useHomeController()
  return <HomeView {...state} />
}

export default App
