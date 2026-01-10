"use client";
import { useEffect, useReducer } from "react";
import "./page.css";

const URLS = [
    "grelli.jpg",
    "walk.jpg",
    "pants.jpg",
    "krummi.jpg",
    "cover.jpg",
    "puffin.jpg",
    "pumpkins.jpg",
];

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


export default function Page() {
    const url = useRandom(URLS, 10_000);

    return <div className="annie_40">
        <div className="background" style={{'backgroundImage': `url("/annie_40/${url}")`}}></div>
        <article>
            <h1>Save the Date!</h1>
            <div className="subtitle">Annie's 40th Birthday</div>
            
            <div className="divider"></div>
            
            <div className="details">
                <p>Saturday, March 28th, 2026</p>
                <p>Midtown, Manhattan</p>
                <p>Location TBA</p>
                <p>Hotel Block TBA</p>
            </div>
            
            <div className="divider"></div>
            
            <div className="rsvp">
                Tentative RSVP with David or Annie by Feb 20th
            </div>
        </article>
    </div>
}