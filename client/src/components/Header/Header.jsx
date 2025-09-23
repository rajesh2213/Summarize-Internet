import {useNavigate, Link} from 'react-router-dom'
import {useAuth} from '../../contexts/AuthContext.jsx'
import {useTheme} from '../../contexts/ThemeContext.jsx'
import {useState, useEffect} from 'react'
import logger from '../../utils/logger.js'
import styles from './Header.module.css'

const Header = () => {
    const auth = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            setIsScrolled(scrollTop > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (!auth) {
        return (
            <header className={`${styles.header} ${isScrolled ? styles.scrolled : styles.floating}`}>
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
        <header className={`${styles.header} ${isScrolled ? styles.scrolled : styles.floating}`}>
            <div className={styles.headerContent}>
                <Link to='/' className={styles.webName}>
                    Summarize-Internet
                </Link>
                <nav className={styles.navigation}>
                    <button onClick={toggleTheme} className={styles.themeToggle}>
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                    {isAuth ? (
                        <>
                            <p className={styles.welcomeText}>Hi, {user?.username}</p>
                            <button onClick={handleLogout}><span>Logout</span></button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => navigate("/login")}><span>Log in</span></button>
                            <button onClick={() => navigate("/register")}><span>Sign up for free</span></button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    )
}
export default Header;