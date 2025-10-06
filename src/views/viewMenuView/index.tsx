"use client"

import NavbarComponent from "@/components/navbar";

const ViewMenuView = () => {

    return <div>
        <NavbarComponent></NavbarComponent>
        <div className="flex w-full justify-center flex-col space-y-2 mt-8">
            <h1 className="font-bold text-[48px] text-center">Selecciona un menú</h1>
            <h2 className="text-[24px] text-center">Here you choose and review menus...</h2>
        </div>


    </div>
}

export default ViewMenuView;