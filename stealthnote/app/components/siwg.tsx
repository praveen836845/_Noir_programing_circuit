"use client";

import React from "react";
import Image from "next/image";
import googleLogo from "@/assets/google.png";

const SignWithGoogleButton = (props: { onClick: () => void; isLoading: boolean, disabled: boolean }) => {
  return (
    <button 
      onClick={() => props.onClick()} 
      className="google-oauth-button" 
      disabled={props.disabled}
    >
      {props.isLoading ? (
        <span className="spinner-icon" />
      ) : (
        <>
          <Image
            src={googleLogo}
            alt="Google logo"
            width={20}
            height={20}
          />
          <span>Continue with Google</span>
        </>
      )}
    </button>
  );
};

export default SignWithGoogleButton;
