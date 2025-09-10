import {useNavigate, Link} from 'react-router-dom'
import {useAuth} from '../../contexts/AuthContext.jsx'
import logger from '../../utils/logger.js'
import styles from './Header.module.css'

const Header = () => {
    const auth = useAuth();
    const navigate = useNavigate();

    if (!auth) {
        return (
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <span className={styles.webName}>Loading...</span>
                </div>
            </header>
        );
    }

    const {isAuth, logout, user} = auth;

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/'); 
        } catch(err) {
            logger.warn('Logout failed: ', err);
        }
    }

    return (
        <header className={styles.header}>
            <div className={styles.headerContent}>
                <Link to='/' className={styles.webName}>
                    Summarize-Internet
                </Link>
                <nav className={styles.navigation}>
                    {isAuth ? (
                        <>
                            <p className={styles.welcomeText}>Hi, {user?.username}</p>
                            <button onClick={handleLogout}>Logout</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => navigate("/login")}>Log in</button>
                            <button onClick={() => navigate("/register")}>Sign up for free</button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    )
}
export default Header;