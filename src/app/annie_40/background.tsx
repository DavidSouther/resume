"use client";

import { useEffect, useReducer } from "react";

function useRandom<T>(items: ReadonlyArray<T>, duration: number) {
    const getItem = () => items[(Math.random() * items.length)|0];
    const [item, dispatch] = useReducer(getItem, getItem());

    useEffect(() => {
        let canceled = false;

        function next() {
            if (canceled) return;
            dispatch();
            window.setTimeout(next, duration);
        }
        window.setTimeout(next, duration);

        return () => {
            canceled = true;
        }
    }, [items, dispatch]);

    return item;
}

export default function Background({urls}: {urls: string[]}) {
    const url = useRandom(urls, 10_000);

    return <div className="background" style={{'backgroundImage': `url("/annie_40/${url}")`}}></div>
}