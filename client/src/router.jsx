import {Routes, Route} from 'react-router-dom';
import Login from './pages/Login/Login.jsx';
import Register from './pages/Register/Register.jsx';
import VerifyUser from './pages/VerifyUser/VerifyUser.jsx'
import Home from './pages/Home/Home.jsx'
import GoogleAuthSuccess from './pages/GoogleAuthSuccess/GoogleAuthSuccess.jsx'

const AppRouter = () => {
    return (
        <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/login' element={<Login />} />
            <Route path='/register' element={<Register />} />
            <Route path='/verify-user' element={<VerifyUser />} />
            <Route path='/auth/google/success' element={<GoogleAuthSuccess />} />
        </Routes>
    )
}

export default AppRouter;