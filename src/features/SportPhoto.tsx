/** Six distinct editorial photographs, bundled for use without a connection. */
export function SportPhoto({index=0,alt,className=''}:{index?:number;alt:string;className?:string}) {
 const cell=((index%6)+6)%6;
 // Move the SVG viewport over the atlas. A negative-positioned <image> was
 // cropped incorrectly in Android WebView on wide cards.
 return <div className={`sport-photo ${className}`} role={alt?'img':undefined} aria-label={alt||undefined} aria-hidden={!alt||undefined}><svg viewBox={`${(cell%3)*512} ${Math.floor(cell/3)*512} 512 512`} preserveAspectRatio={cell===4?"xMidYMid slice":"xMidYMin slice"} aria-hidden="true" focusable="false"><image href="/images/sports-atlas.png" x="0" y="0" width="1536" height="1024" preserveAspectRatio="none"/></svg></div>;
}
