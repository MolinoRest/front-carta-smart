import Link from "next/link";

const NavbarComponent = () => {
  const items = [
    { text: "Ver menús", path: "/view-menu" }, { text: "Editar menús", path: "/edit-menu" }, { text: "ChatBot", path: "/chat-bot" }
  ]
  return <div className="w-full px-8 pt-8 flex flex-row justify-between">
    <div className="">
      <Link href={"/"}>
        <h1 className="text-black font-bold text-[20px]">CARTA SMART</h1>
      </Link>
    </div>
    <div className="flex space-x-4">
      {items.map((items, index) => {
        return <div key={index}>
          <Link href={items.path}>
            <p className="font-bold text-[16px]">{items.text}</p>
          </Link>
        </div>
      })}
    </div>
  </div>
}

export default NavbarComponent;