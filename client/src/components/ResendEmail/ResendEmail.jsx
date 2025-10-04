import styles from './ResendEmail.module.css'
import { useState, useEffect, useRef } from 'react'
import {resendVerificationEmail} from '../../services/authService'
import logger from '../../utils/logger';

const ResendEmail = ({ email }) => {
    const [isResending, setIsResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [resendStatus, setResendStatus] = useState('');
    const cooldownIntervalRef = useRef(null);

    const startCooldown = () => {
        setCooldown(60)
        cooldownIntervalRef.current = setInterval(() => {
            setCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(cooldownIntervalRef.current)
                    return 0
                }
                return prev - 1;
            })
        }, 1000)
    };

    useEffect(() => {
        return () => clearInterval(cooldownIntervalRef.current);
    }, []);

    const handleResendEmail = async () => {
        if (!email || isResending || cooldown > 0) return;

        setIsResending(true);
        setResendStatus('Sending...');

        try {
            const res = await resendVerificationEmail(email);
            const data = await res.json();
            if (res.ok) {
                setResendStatus('New verification email sent successfully! ✅');
                startCooldown();
            } else {
                setResendStatus(data.message || 'Failed to resend email. Please try again later.');
            }
        } catch (err) {
            logger.warn('Failed to resend email: ', err)
            setResendStatus('Failed to resend email. Please check your network and try again.');
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className={styles.resendContainer}>
            <h2>User registered successfully.</h2>
            <p>Please check your email to verify your account.</p>
            <button
                className={styles.resendButton}
                onClick={handleResendEmail}
                disabled={isResending || cooldown > 0}
            >
                {isResending
                    ? 'Resending...'
                    : cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : 'Resend Verification Email'}
            </button>
            {resendStatus && <p className={styles.resendStatus}>{resendStatus}</p>}
        </div>
    )
}

export default ResendEmail