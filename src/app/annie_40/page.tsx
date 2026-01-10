"use client";
import { useEffect } from "react";
import "./page.css";

const URLS = [
    "grelli.jpg",
    "walk.jpg",
    "pants.jpg"
];

export default function Page() {
    useEffect(() => {
        let canceled = false;

        function changePhoto() {
            if (canceled) return;
            const idx = Math.floor(Math.random() * URLS.length);
            const url = URLS[idx];
            document.body.style.backgroundImage = `url(/annie_40/${url})`;
            window.setTimeout(changePhoto, 10_000);
        }
        window.setTimeout(changePhoto, 10_000);

        return () => {
            canceled = true;
            document.body.style.backgroundImage = ``;
        }

    });

    return <div className="container">
        <h1>Save the Date!</h1>
        <div className="subtitle">Annie's 40th Birthday</div>
        
        <div className="divider"></div>
        
        <div className="details">
            <p><span className="highlight">Saturday, March 28th, 2026</span></p>
            <p>Midtown, Manhattan</p>
            <p>Location TBA</p>
            <p>Hotel Block TBA</p>
        </div>
        
        <div className="divider"></div>
        
        <div className="rsvp">
            Tentative RSVP with David or Annie by Feb 20th
        </div>
    </div>
}