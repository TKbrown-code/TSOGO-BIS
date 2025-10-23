import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import "../styles/form.css"
import useFormValidation from "../hooks/verifyForm";
import useUserInfo from "../hooks/useUserInfo";
import LoadingUX from "../components/loadingUX"

export default function Form (){
    const { t } = useTranslation();
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
                        <h2>{isSignUp === true ? t('auth.signup_title') : t('auth.signin_title')}</h2>
                        <p>{t('auth.subtitle')}</p>   
                    </div>
                   
                        {isSignUp === true ? 
                        (<>
                         <form onSubmit={handleSubmit}>
                            <fieldset>
                            <legend>
                               {t('auth.full_name')}<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="name" name="fullName" value={form.fullName} onChange={handleChange} placeholder={t('auth.full_name_placeholder')} required/>
                        </fieldset>
                        <p style={styleErr("fullName")}>{errors.fullName}</p> 
                        <fieldset>
                            <legend>
                               {t('auth.email')}<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder={t('auth.email_placeholder')} required/>
                        </fieldset> 
                        <p style={styleErr("email")}>{errors.email}</p>
                        <fieldset>
                            <legend>
                                {t('auth.phone')}<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder={t('auth.phone_placeholder')} required/>
                        </fieldset>
                        <p style={styleErr("phone_number")}>{errors.phone}</p>
                        <fieldset>
                            <legend>
                                {t('auth.password')}<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder={t('auth.password_placeholder')} required/>
                        </fieldset>
                        <p style={styleErr("password")}>{errors.password}</p>
                        <fieldset>
                            <legend>
                               {t('auth.verify_password')}<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="password" name="vpassword" value={form.Vpassword} onChange={handleChange} placeholder={t('auth.password_placeholder')} required/>
                        </fieldset>
                        <p style={styleErr("vpassword")}>{errors.vpassword}</p>
                         <div className="policy">
                            <input type="checkbox" name="policy" checked={form.policy} onChange={handleChange}/>
                            <span>{t('auth.agree_policy')} <Link> {t('auth.policies')}</Link></span>
                        </div>
                        <p style={styleErr("policy")}>{errors.policy}</p>
                        <button className="formbtn">{loading === true ? <LoadingUX loading setLoading/> : ""}<span>{isSignUp === true ? t('auth.signup') : t('auth.signin')}</span></button>
                    </form>
                        </>) : 
                        (<>
                         <form onSubmit={handleSignIn}>
                        <fieldset>
                            <legend>
                               {t('auth.email')}<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="email" name="email" value={form.email} onChange={handleChangeSign} placeholder={t('auth.email_placeholder')} required/>
                        </fieldset>
                        <p style={styleErr("email")}>{errors.email}</p> 
                        <fieldset>
                            <legend>
                                {t('auth.password')}<span style={{color:"red"}}>*</span>
                            </legend>
                            <input type="password" name="password" value={form.password} onChange={handleChangeSign} placeholder={t('auth.password_placeholder')} required/>
                        </fieldset>
                        <p style={styleErr("password")}>{errors.password}</p>
                        <div className="policy">
                            <input type="checkbox" name="policy" checked={form.policy} onChange={handleChangeSign}/>
                            <span>{t('auth.agree_policy')} <Link> {t('auth.policies')}</Link></span>
                        </div>
                        <p style={styleErr("policy")}>{errors.policy}</p>
                        <button type="submite" className="formbtn">{loading === true ? <LoadingUX/> : ""}<span>{isSignUp === true ? t('auth.signup') : t('auth.signin')}</span></button>
                    </form>
                        </>
                        )}
                        
                    <span>{isSignUp ===true ? t('auth.have_account') : t('auth.no_account')} <span onClick={() => setIsSignUp(!isSignUp)} style={{color:"blue", cursor:"pointer"}}>{isSignUp === true ? t('auth.signin') : t('auth.signup')}</span></span>    
                </div>            
          </div>
        </>
    )
}
