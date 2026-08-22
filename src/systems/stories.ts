/**
 * The story, told a piece at a time. One chapter lands after every tenth floor —
 * right after a boss falls — and the last two are the ending: out of the castle, onto
 * a strange planet, and the thing that is waiting there.
 *
 * Keyed by the floor you have just finished, so `storyAfterFloor(10)` is what you read
 * on your way down to floor 11.
 */

export interface Story {
  /** The floor you just cleared. */
  afterFloor: number;
  title: string;
  /** Each page is shown on its own, a few lines at a time. */
  pages: string[][];
}

export const STORIES: Story[] = [
  {
    afterFloor: 10,
    title: 'THE FIRST CROWN',
    pages: [
      [
        'The Demon Lord falls, and its crown cracks in half.',
        '',
        'From somewhere far below, something laughs.',
        '"That was the first of us," it says. "There are nine more."',
      ],
    ],
  },
  {
    afterFloor: 20,
    title: 'THE WARM WALLS',
    pages: [
      [
        'The second crown crumbles to dust in your hand.',
        '',
        'You notice the walls are warm. Not hot — warm,',
        'like something asleep.',
        '',
        'The castle breathes in. Then out. Then in again.',
      ],
    ],
  },
  {
    afterFloor: 30,
    title: 'THE OTHERS',
    pages: [
      [
        'Behind the third crown you find scratches in the stone.',
        '',
        'Names. Hundreds of them. Everyone who came down here',
        'before you and did not come back up.',
      ],
      [
        'At the very bottom, freshly cut, there is a space.',
        '',
        'It is exactly the size of your name.',
        'You keep going.',
      ],
    ],
  },
  {
    afterFloor: 40,
    title: 'WHAT THE KEYS ARE MADE OF',
    pages: [
      [
        'You have been forging keys from demon dust for forty floors.',
        '',
        'Tonight one of them turns in your hand, on its own,',
        'and points down.',
        '',
        'The keys want to go deeper too.',
      ],
    ],
  },
  {
    afterFloor: 50,
    title: 'HALFWAY',
    pages: [
      [
        'The fifth crown does not crack. It opens, like a mouth.',
        '',
        '"Halfway," it says. "Turn around and I will let you out.',
        'You can keep the coins. You can keep the crates."',
      ],
      [
        'You think about it for exactly one second.',
        '',
        'Then you shut the mouth with your boot',
        'and take the stairs down.',
      ],
    ],
  },
  {
    afterFloor: 60,
    title: 'THE CASTLE IS NOT A CASTLE',
    pages: [
      [
        'Floor sixty has a window.',
        '',
        'Sixty floors underground, and a window.',
        '',
        'Through it you see stars going past. Fast.',
        'The castle is not sitting on the ground at all.',
        'It is moving.',
      ],
    ],
  },
  {
    afterFloor: 70,
    title: 'THE DEMONS ARE RUNNING',
    pages: [
      [
        'Something is wrong with the demons on this floor.',
        '',
        'They are not chasing you. They are running past you,',
        'going up, climbing over each other to get out.',
      ],
      [
        'One of them stops. Looks at you. Points down.',
        '',
        '"Not us," it says. "It. It is down there."',
        'Then it runs.',
      ],
    ],
  },
  {
    afterFloor: 80,
    title: 'THE SKY UNDERNEATH',
    pages: [
      [
        'The eighth crown breaks and the ceiling breaks with it.',
        '',
        'Above you: rock, as always.',
        'Below you, through the cracks in the floor: sky.',
        '',
        'Purple sky. Two suns. You are nearly through.',
      ],
    ],
  },
  {
    afterFloor: 90,
    title: 'THE LAST DOOR',
    pages: [
      [
        'Ninety floors. Nine crowns. One door left.',
        '',
        'It is not locked. It has never been locked.',
        'It has a handle on your side and nothing on the other.',
      ],
      [
        'Behind it you can hear the tenth Demon Lord',
        'sharpening something very large.',
        '',
        'You put your hand on the handle.',
      ],
    ],
  },
  {
    afterFloor: 100,
    title: 'OUT OF THE CASTLE',
    pages: [
      [
        'The tenth crown falls. And then it is quiet.',
        '',
        'No more stairs down. No more floors.',
        'Just a door, standing open, with light coming through it.',
        '',
        'You step out of the castle.',
      ],
      [
        'There is no ground.',
        '',
        'You fall for a long, long time — past the castle,',
        'past the stars, past two suns —',
        '',
        'and you land on a weird planet.',
      ],
      [
        'Purple sand. Orange rock. A sky full of broken moons.',
        '',
        'And standing in the middle of it, waiting,',
        'as if he has been waiting the whole hundred floors:',
        '',
        'THANOS.',
      ],
      [
        'He is enormous. He does not chase. He does not scream.',
        'He simply starts walking towards you.',
        '',
        'His health bar goes all the way across the sky.',
        '40,000.',
        '',
        'Good luck.',
      ],
    ],
  },
  {
    afterFloor: 101,
    title: 'THE TITAN FALLS',
    pages: [
      [
        'Forty thousand. You took it down twenty at a time.',
        '',
        'Thanos goes to one knee, and then to no knees at all,',
        'and the purple sand blows over where he was standing.',
      ],
      [
        'The broken moons come back together.',
        'The two suns come up at once.',
        '',
        'And far above you, small and dark against the light,',
        'the castle turns around and starts coming back.',
      ],
      [
        'It lands beside you and opens its door.',
        '',
        'There are more floors inside. There are always more floors.',
        '',
        'You dust off your sword and walk back in.',
      ],
    ],
  },
];

export function storyAfterFloor(floor: number): Story | undefined {
  return STORIES.find((s) => s.afterFloor === floor);
}

export function hasStoryAfter(floor: number): boolean {
  return storyAfterFloor(floor) !== undefined;
}
