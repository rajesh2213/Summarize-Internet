import { useSearchParams, Link } from "react-router-dom"

const VerifyUser = () => {
    let [searchParams] = useSearchParams();
    const status = searchParams.get("status")
    let message = searchParams.get("message")
    if(message){
        message = message.split('_').join(' ')
    }
    return (
        <div>
            {status === "success" ? (
                <div>
                    <h2>Veification successful!</h2>
                    <Link to="/login">Login...</Link>
                </div>
            ) : status === "fail" ? (
                <div>
                    <h2>Verifiation failed!</h2>
                    <p>{message || "Oops...Something went wrong"}</p>
                </div>
            ) : status === "pending" (
                <div>
                    <h2>Pending email verification!</h2>
                    <p>{message || "Oops...Something went wrong"}</p>
                </div>
            )}
        </div>
    )
}

export default VerifyUser