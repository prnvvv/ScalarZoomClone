import Image from "next/image";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="signin-split">
      <div className="signin-split__left">
        <div className="signin-split__logo">
          <Image
            src="/images/f4.png"
            alt=""
            fill
            sizes="(max-width: 768px) 70vw, 520px"
            priority
            className="signin-split__image"
          />
        </div>
      </div>
      <div className="signin-split__right">
        <SignUp />
      </div>
    </div>
  );
}
