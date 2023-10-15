const size = 16;
const width = 2;
const radius = (size - width) / 2;

type Props = { progress: number };
export const Progress = ({ progress: p }: Props) => {
  const progress = Math.max(p, 10);
  const circumference = radius * 2 * Math.PI;

  return (
    <svg width={`${size}`} height={`${size}`}>
      <circle
        className="dark:stroke-gray stroke-lightGray"
        strokeWidth={`${width}`}
        fill="transparent"
        r={`${radius}`}
        cx={`${size / 2}`}
        cy={`${size / 2}`}
      />
      <circle
        className="-rotate-90 origin-center dark:stroke-white stroke-black"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={`${circumference - (progress / 100) * circumference}`}
        strokeWidth={`${width}`}
        fill="transparent"
        r={`${radius}`}
        cx={`${size / 2}`}
        cy={`${size / 2}`}
      />
    </svg>
  );
};
