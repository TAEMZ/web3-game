export default function Footer() {
  return (
    <footer className="footer border-base-300 dark:border-neutral text-base-content mx-1 mt-4 w-auto grid-flow-col items-center justify-between border-t-2 p-4 md:mx-16 lg:mx-40">
      <div className="items-center">
        <p>&copy; {new Date().getFullYear()} Chess Arena</p>
      </div>
    </footer>
  );
}
