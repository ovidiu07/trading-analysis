package com.tradevault.service.marketdata;

import java.net.*;
import java.nio.charset.StandardCharsets;

/** Fixed public downloads; never follows an arbitrary redirect or sends credentials. */
public final class OfficialReferenceHttp {
    public static final String ECB = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
    public static final String EIA = "https://ir.eia.gov/wpsr/psw00.json";
    private OfficialReferenceHttp() {}
    public static boolean allowedRedirect(String original, URI target) {
        return EIA.equals(original) && "https".equals(target.getScheme()) && "ir.eia.gov".equals(target.getHost())
            && target.getPort()==-1 && target.getUserInfo()==null && target.getFragment()==null
            && "/secure/wpsr/psw00.json".equals(target.getRawPath());
    }
    public static String get(String url) {
        if (!ECB.equals(url) && !EIA.equals(url)) throw new IllegalArgumentException("Reference endpoint is not allowlisted");
        URI target=URI.create(url);
        for (int attempt=0;attempt<2;attempt++) {
            HttpURLConnection connection=null;
            try {
                connection=(HttpURLConnection)target.toURL().openConnection();
                connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(3000);connection.setReadTimeout(5000);
                connection.setRequestProperty("User-Agent","TradeJAudit-OfficialContext/1.0 (+https://tradejaudit.com)");
                connection.setRequestProperty("Accept","application/json,application/xml,text/xml");
                int status=connection.getResponseCode();
                if (attempt==0 && java.util.Set.of(301,302,303,307,308).contains(status)) {
                    URI next=target.resolve(connection.getHeaderField("Location"));
                    if (!allowedRedirect(url,next)) throw new IllegalStateException("Official redirect rejected");
                    target=next;continue;
                }
                if (status!=200) throw new IllegalStateException("Official reference HTTP "+status);
                try(var body=connection.getInputStream()) {
                    byte[] bytes=body.readNBytes(2_000_001);
                    if(bytes.length>2_000_000)throw new IllegalStateException("Official response exceeds size limit");
                    return new String(bytes,StandardCharsets.UTF_8);
                }
            } catch(java.io.IOException | IllegalArgumentException e) { throw new IllegalStateException("Official reference unavailable"); }
            finally {if(connection!=null)connection.disconnect();}
        }
        throw new IllegalStateException("Official reference unavailable");
    }
}
