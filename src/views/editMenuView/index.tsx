"use client"

import NavbarComponent from "@/components/navbar";

const EditMenuView = () => {
    return <div>
        <NavbarComponent></NavbarComponent>
        <div className="w-full flex justify-center mt-8">
            <h1 className="text-center font-bold text-[48px]">
                Here comes the edit view...
            </h1>
        </div>
    </div>
}

export default EditMenuView;