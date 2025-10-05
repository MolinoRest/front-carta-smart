"use client"

import NavbarComponent from "@/components/navbar";
import Link from "next/link";

const EditMenuView = () => {
    return <div>
        <NavbarComponent></NavbarComponent>

        <Link href={"/"}>VOLVER</Link>
        EDIT MENU
    </div>
}

export default EditMenuView;