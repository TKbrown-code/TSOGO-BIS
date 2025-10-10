import { useState } from "react"
import { Link } from "react-router-dom"
import "../styles/form.css"
import useFormValidation from "../hooks/verifyForm";
import useUserInfo from "../hooks/useUserInfo";
import LoadingUX from "../components/loadingUX"

export default function Form (){
    const [isSignUp, setIsSignUp] = useState(true);
    const { form, errors, handleChange, validateForm, handleChangeSign,validateFormSignIn } = useFormValidation({
        fullName: "",
        email: "",
        phone: "",
        password: "",
        vpassword: "",
        policy: false,
    });
    const [loading, setLoading] = useState(false);
    const { SignIn, SignUP } = useUserInfo({ form, isSignUp, setLoading });

    const handleSubmit = (e) => {
        e.preventDefault();
            if (!validateForm()) {
                return;
            } 
            setLoading(true);
            if(isSignUp)
                SignUP();
        };

   const handleSignIn = (e) => {
        e.preventDefault();
            if (!validateFormSignIn()) {
                return;
            } 
            setLoading(true);

            if(!isSignUp)
                SignIn();
   }

    const styleErr = (field) => ({
        display: errors[field] ? "block" : "none",
        color:"red",
        fontSize: "0.6em",
        textAlign:"start",
        margin:"0"
    });

    return(
        <>
          <div className="formBody">
                <div className="formContainer">
                    <div className="formHeader">
                        <h2>{isSignUp === true ? "Sign Up For TSOGO-BIS" : "Sign Into TSOGO-BIS"}</h2>
                        <p>For a faster and efficiant service</p>   
                    </div>
                   
                        {isSignUp === true ? 
                        (<>
                         <form onSubmit={handleSubmit}>
                            <fieldset>
                            <legend>
                               Your Full-Names<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="name" name="fullName" value={form.fullName} onChange={handleChange} placeholder="enter your full names.." required/>
                        </fieldset>
                        <p style={styleErr("fullName")}>{errors.fullName}</p> 
                        <fieldset>
                            <legend>
                               Your Email<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="example@email.com" required/>
                        </fieldset> 
                        <p style={styleErr("email")}>{errors.email}</p>
                        <fieldset>
                            <legend>
                                Your Phone Number<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+(237) 678 554 120" required/>
                        </fieldset>
                        <p style={styleErr("phone_number")}>{errors.phone}</p>
                        <fieldset>
                            <legend>
                                Your Password<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="password must be 6 characters long" required/>
                        </fieldset>
                        <p style={styleErr("password")}>{errors.password}</p>
                        <fieldset>
                            <legend>
                               Verify Your Password<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="password" name="vpassword" value={form.Vpassword} onChange={handleChange} placeholder="password must be 6 characters long" required/>
                        </fieldset>
                        <p style={styleErr("vpassword")}>{errors.vpassword}</p>
                         <div className="policy">
                            <input type="checkbox" name="policy" checked={form.policy} onChange={handleChange}/>
                            <span>I agree to TSOGO-BIS <Link> policies</Link></span>
                        </div>
                        <p style={styleErr("policy")}>{errors.policy}</p>
                        <button className="formbtn">{loading === true ? <LoadingUX loading setLoading/> : ""}<span>{isSignUp === true ? "Sign Up" : "Sign In"}</span></button>
                    </form>
                        </>) : 
                        (<>
                         <form onSubmit={handleSignIn}>
                        <fieldset>
                            <legend>
                               Your Email<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="email" name="email" value={form.email} onChange={handleChangeSign} placeholder="example@email.com" required/>
                        </fieldset>
                        <p style={styleErr("email")}>{errors.email}</p> 
                        <fieldset>
                            <legend>
                                Your Password<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="password" name="password" value={form.password} onChange={handleChangeSign} placeholder="password must be 6 characters long" required/>
                        </fieldset>
                        <p style={styleErr("password")}>{errors.password}</p>
                        <div className="policy">
                            <input type="checkbox" name="policy" checked={form.policy} onChange={handleChangeSign}/>
                            <span>I agree to TSOGO-BIS <Link> policies</Link></span>
                        </div>
                        <p style={styleErr("policy")}>{errors.policy}</p>
                        <button type="submite" className="formbtn">{loading === true ? <LoadingUX/> : ""}<span>{isSignUp === true ? "Sign Up" : "Sign In"}</span></button>
                    </form>
                        </>
                        )}
                        
                    <span>{isSignUp ===true ? "Already have an account?" : "Don't have an account?"} <span onClick={() => setIsSignUp(!isSignUp)} style={{color:"blue", cursor:"pointer"}}>{isSignUp === true ? "Sign In" : "Sign Up"}</span></span>    
                </div>            
          </div>
        </>
    )
}
